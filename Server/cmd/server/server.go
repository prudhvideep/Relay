package main

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	Peers map[string]*websocket.Conn
}

func NewServer() *Server {
	return &Server{
		Peers: make(map[string]*websocket.Conn),
	}
}

func GetClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		ips := strings.Split(forwarded, ",")
		return strings.TrimSpace(ips[0])
	}

	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

func (s *Server) ReadLoop(peerId string, conn *websocket.Conn) {
	defer conn.Close()

	for {
		if s.Peers[peerId] != conn {
			log.Println("Closing the conn ", conn)
			return
		}
		_, data, err := conn.ReadMessage()

		if err != nil {
			log.Println("Conn closed ", err.Error())
			delete(s.Peers, peerId)
			return
		}

		log.Printf("Received - %s\n", string(data))
	}
}

func (s *Server) HandlePeerJoin(w http.ResponseWriter, r *http.Request) {
	peerId := r.URL.Query().Get("peerId")
	if peerId == "" {
		log.Println("Peer id empty ")
		return
	}

	log.Println("Peer id ", peerId)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading the connection ", err.Error())
		return
	}

  if oldConn,exist := s.Peers[peerId];exist {
		log.Println("Closing old connection for peer", peerId)
		oldConn.Close()
	}

	s.Peers[peerId] = conn
	go s.ReadLoop(peerId, conn)
}

func (s *Server) HandlePeerConns(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var peers []string

	for peer := range s.Peers {
		peers = append(peers, peer)
	}

	log.Println(peers)

	if err := json.NewEncoder(w).Encode(peers); err != nil {
		log.Println(err)
	}
}

func main() {
	s := NewServer()
	http.HandleFunc("/ws", s.HandlePeerJoin)
	http.HandleFunc("/conns", s.HandlePeerConns)

	log.Fatal(http.ListenAndServe("localhost:6969", nil))
}
